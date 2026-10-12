/*
 * Date formats for {{date:…}}: YYYY YY MMMM MMM MM M DD D dddd ddd HH H mm ss.
 * Letters that aren't tokens are kept ("D MMMM YYYY" → "7 March 2026").
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOKEN = /YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|mm|ss/g;
const pad = (n) => String(n).padStart(2, "0");

export function formatDate(date, format) {
  const d = date;
  return format.replace(TOKEN, (t) => {
    switch (t) {
      case "YYYY": return String(d.getFullYear());
      case "YY": return pad(d.getFullYear() % 100);
      case "MMMM": return MONTHS[d.getMonth()];
      case "MMM": return MONTHS[d.getMonth()].slice(0, 3);
      case "MM": return pad(d.getMonth() + 1);
      case "M": return String(d.getMonth() + 1);
      case "DD": return pad(d.getDate());
      case "D": return String(d.getDate());
      case "dddd": return DAYS[d.getDay()];
      case "ddd": return DAYS[d.getDay()].slice(0, 3);
      case "HH": return pad(d.getHours());
      case "H": return String(d.getHours());
      case "mm": return pad(d.getMinutes());
      default: return pad(d.getSeconds()); // ss
    }
  });
}

// {{date}} / {{time}} without a format: the user's locale.
export const localDate = (d) => d.toLocaleDateString();
export const localTime = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
