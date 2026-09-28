import { useCallback, useEffect, useState } from "react";

import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { Entity } from "../../common/components/entities/Entity";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { ENTITY_STATUS } from "../../utils/constants";
import {
  ACTIVE_TASK_QUEUE_COUNT_QUERY,
  ACTIVE_TASK_QUEUE_FILTER,
  ACTIVE_TASK_QUEUE_QUERY,
  GqlTaskQueueItem,
} from "../graphql";

// Enough to cover a real backlog without paging inside a dialog
const DIALOG_LIMIT = 100;

const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const actionLabel = (item: GqlTaskQueueItem) => {
  const action = humanize(item.action || "task");
  // Workspace syncs are queued under the resource they sync
  return item.entity === "workspace"
    ? `Workspace ${action.toLowerCase()}`
    : action;
};

const QueueRow = ({ item }: { item: GqlTaskQueueItem }) => {
  const running = item.status === "running";
  const requestedBy = item.creator?.identifier;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {item.entityData ? (
          <Entity
            entity={{
              ...item.entityData,
              id: item.entityId ?? undefined,
              entityType: item.entityData.entityName ?? item.entity,
            }}
            showLabel
            noWrap
          />
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {humanize(item.entity)}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" component="div">
          {actionLabel(item)} ·{" "}
          {running ? (
            <>
              started <RelativeTime date={item.startedAt || item.createdAt} />
              {item.workerHost ? ` on ${item.workerHost}` : ""}
            </>
          ) : (
            <>
              queued <RelativeTime date={item.createdAt} />
            </>
          )}
          {requestedBy ? ` · by ${requestedBy}` : ""}
          {item.retries > 0
            ? ` · retry ${item.retries}/${item.maxRetries}`
            : ""}
        </Typography>
      </Box>
      <StatusChip
        status={running ? ENTITY_STATUS.IN_PROGRESS : ENTITY_STATUS.QUEUED}
      />
    </Box>
  );
};

/**
 * Header button on the Tasks page: shows how many tasks are waiting for or
 * running on a worker, and opens a dialog listing them.
 */
export const TaskQueueButton = () => {
  const { ikApi } = useConfig();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<GqlTaskQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ikApi
      .graphqlRequest(ACTIVE_TASK_QUEUE_COUNT_QUERY, {
        filter: ACTIVE_TASK_QUEUE_FILTER,
      })
      .then((response: any) => setCount(response?.taskQueueItemsCount ?? 0))
      .catch(() => setCount(0));
  }, [ikApi]);

  const loadQueue = useCallback(() => {
    setLoading(true);
    ikApi
      .graphqlRequest(ACTIVE_TASK_QUEUE_QUERY, {
        filter: ACTIVE_TASK_QUEUE_FILTER,
        sort: ["created_at", "ASC"],
        range: [0, DIALOG_LIMIT],
      })
      .then((response: any) => {
        setItems(response?.taskQueueItems ?? []);
        setCount(response?.taskQueueItemsCount ?? 0);
      })
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, [ikApi]);

  const handleOpen = () => {
    setOpen(true);
    loadQueue();
  };

  const running = items.filter((item) => item.status === "running");
  const queued = items.filter((item) => item.status === "queued");

  return (
    <>
      <Tooltip title="Tasks waiting for or running on a worker">
        <Badge badgeContent={count} color="primary" max={99}>
          <Button
            variant="outlined"
            startIcon={<HourglassEmptyIcon />}
            onClick={handleOpen}
          >
            Queue
          </Button>
        </Badge>
      </Tooltip>
      <CommonDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Task queue"
        maxWidth="md"
        hasFooterActions={false}
        headerAction={
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={loadQueue} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        }
        content={
          loading && items.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : items.length === 0 ? (
            <Typography
              color="text.secondary"
              sx={{ py: 3, textAlign: "center" }}
            >
              No tasks are waiting for a worker.
            </Typography>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {running.length} running · {queued.length} queued
                {count > items.length
                  ? ` · showing the oldest ${items.length}`
                  : ""}
              </Typography>
              {items.map((item, index) => (
                <Box key={item.id}>
                  {index > 0 && <Divider />}
                  <QueueRow item={item} />
                </Box>
              ))}
            </Box>
          )
        }
      />
    </>
  );
};
