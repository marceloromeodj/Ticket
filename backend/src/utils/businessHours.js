const moment = require('moment-timezone');

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Suma minutos "laborables" a una fecha, saltando fuera del horario de
 * atención (business_hours, semanal recurrente) y los días marcados como
 * feriado (holidays: ["YYYY-MM-DD", ...]). Usado para el vencimiento de
 * SLA cuando la política tiene business_hours_only=true -- si no, el
 * cálculo es simplemente calendario corrido (ver slaService).
 *
 * Avanza día por día (no minuto a minuto) para no ser lento: por cada día
 * calcula cuántos minutos laborables quedan disponibles desde el puntero
 * actual y descuenta de ahí, hasta agotar `minutesToAdd`.
 */
function addBusinessMinutes(startDate, minutesToAdd, { businessHours, holidays = [], timezone = 'UTC' } = {}) {
  let remaining = minutesToAdd;
  let cursor = moment.tz(startDate, timezone);
  const holidaySet = new Set(holidays);

  // Tope de seguridad: si por algún motivo no hay ningún día laborable
  // configurado, no looping infinito -- se cae a calendario corrido.
  for (let guard = 0; guard < 3650; guard++) {
    const dayKey = WEEKDAY_KEYS[cursor.day()];
    const dateStr = cursor.format('YYYY-MM-DD');
    const daySchedule = businessHours?.[dayKey];
    const isHoliday = holidaySet.has(dateStr);

    if (daySchedule?.active && !isHoliday) {
      const dayOpen  = moment.tz(`${dateStr} ${daySchedule.open}`,  'YYYY-MM-DD HH:mm', timezone);
      const dayClose = moment.tz(`${dateStr} ${daySchedule.close}`, 'YYYY-MM-DD HH:mm', timezone);

      const windowStart = moment.max(cursor, dayOpen);
      if (windowStart.isBefore(dayClose)) {
        const availableMins = dayClose.diff(windowStart, 'minutes');
        if (remaining <= availableMins) {
          return windowStart.clone().add(remaining, 'minutes').toDate();
        }
        remaining -= availableMins;
      }
    }

    // Al día siguiente, desde el arranque (no importa la hora del cursor
    // original una vez que se pasó de ese día).
    cursor = cursor.clone().add(1, 'day').startOf('day');
  }

  // No debería llegar acá con una config de horarios razonable.
  return moment.tz(startDate, timezone).add(minutesToAdd, 'minutes').toDate();
}

module.exports = { addBusinessMinutes };
