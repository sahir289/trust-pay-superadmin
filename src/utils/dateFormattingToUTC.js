//custom function to cahnge normal dates to UTC IST

export function getUTCDayRange(date) {
  const inputDate = new Date(date);
  const startUTC = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const endUTC = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
  };
}
