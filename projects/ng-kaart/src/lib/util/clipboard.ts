export function copyToClipboard(toCopy: string | number | boolean) {
  const elem = document.createElement("textarea");
  elem.value = toCopy as string;
  document.body.appendChild(elem);
  elem.select();
  document.execCommand("copy");
  document.body.removeChild(elem);
}
