export type Schedule = (task: () => Promise<void>) => void;

let scheduleTask: Schedule = (task) => {
  void task();
};

export function setSchedule(schedule: Schedule): void {
  scheduleTask = schedule;
}

export function schedule(task: () => Promise<void>): void {
  scheduleTask(task);
}
