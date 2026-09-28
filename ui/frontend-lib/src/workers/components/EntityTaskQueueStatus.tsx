import { ReactNode } from "react";

import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { Alert, AlertTitle, Box, Chip, Stack, Typography } from "@mui/material";

import { getDateValue } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useEntityProvider } from "../../common/context/EntityContext";
import {
  GqlEntityQueueStatus,
  GqlQueuedTask,
  TaskWaitingReason,
} from "../graphql";

const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** "Execute", or "Workspace sync" for a task queued under another controller. */
const taskLabel = (task: GqlQueuedTask, entityName: string) => {
  const action = humanize(task.action || "task");
  return task.entity === entityName
    ? action
    : `${humanize(task.entity)} ${action.toLowerCase()}`;
};

const waitingReasonText = (
  task: GqlQueuedTask,
  entityName: string,
): Record<TaskWaitingReason, ReactNode> => {
  const position = task.position
    ? ` Position in queue: #${task.position}.`
    : "";
  return {
    entity_busy: `Waits for the running task on this ${humanize(entityName).toLowerCase()} to finish.`,
    retry_delay: (
      <>
        Dependencies are not ready yet. Retry {task.retries}/{task.maxRetries}
        {task.availableAt
          ? ` at ${getDateValue(task.availableAt)}.`
          : " starts soon."}
      </>
    ),
    no_workers:
      "No workers are online. The task starts as soon as a worker becomes available.",
    workers_busy: `All workers are busy.${position}`,
    pending_pickup: `A worker will pick it up shortly.${position}`,
  };
};

const QueuedTaskRow = ({
  task,
  entityName,
}: {
  task: GqlQueuedTask;
  entityName: string;
}) => {
  const running = task.status === "running";
  const requestedBy = task.creatorName ? <> by {task.creatorName}</> : null;

  return (
    <Box>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
      >
        <Chip
          size="small"
          label={running ? "Running" : "Queued"}
          color={running ? "info" : "default"}
          variant={running ? "filled" : "outlined"}
        />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {taskLabel(task, entityName)}
        </Typography>
        <Typography variant="body2" color="text.secondary" component="span">
          {running ? (
            <>
              started <RelativeTime date={task.startedAt || task.createdAt} />
              {task.workerHost ? ` on ${task.workerHost}` : ""}
              {requestedBy}
            </>
          ) : (
            <>
              requested <RelativeTime date={task.createdAt} />
              {requestedBy}
            </>
          )}
        </Typography>
      </Box>
      {!running && task.waitingReason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {waitingReasonText(task, entityName)[task.waitingReason]}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Shows the entity's queued and running worker tasks on its overview page.
 * Reads `taskQueueStatus`, which entity pages fetch together with the entity.
 */
export const EntityTaskQueueStatus = () => {
  const { entity, entity_name } = useEntityProvider();
  const status = entity?.taskQueueStatus as GqlEntityQueueStatus | null;

  if (!status || status.tasks.length === 0) {
    return null;
  }

  const queued = status.tasks.filter((task) => task.status === "queued");
  const noWorkers = queued.some((task) => task.waitingReason === "no_workers");
  const title =
    queued.length === 0
      ? "Task in progress"
      : queued.length === 1
        ? "Task waiting in queue"
        : `${queued.length} tasks waiting in queue`;

  return (
    <Alert
      severity={noWorkers ? "warning" : "info"}
      icon={<HourglassEmptyIcon />}
      sx={{ width: "100%" }}
    >
      <AlertTitle>{title}</AlertTitle>
      <Stack spacing={1}>
        {status.tasks.map((task) => (
          <QueuedTaskRow key={task.id} task={task} entityName={entity_name} />
        ))}
      </Stack>
    </Alert>
  );
};
