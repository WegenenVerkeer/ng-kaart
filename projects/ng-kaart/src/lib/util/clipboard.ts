export function copyToClipboard(toCopy: string) {
  const elem = document.createElement("textarea");
  elem.value = toCopy;
  document.body.appendChild(elem);
  elem.select();
  document.execCommand("copy");
  document.body.removeChild(elem);
}
