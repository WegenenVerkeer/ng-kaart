const fs = require("fs-extra");
const concat = require("concat");

(async function build() {
  const files = [
    "./dist/webcomponent/runtime.js",
    "./dist/webcomponent/polyfills.js",
    // "./dist/webcomponent/scripts.js",
    "./dist/webcomponent/main.js"
  ];

  await fs.ensureDir("elements");
  await concat(files, "elements/webcomponent.js");
  await fs.copyFile(
    "./dist/webcomponent/styles.css",
    "elements/styles.css"
  );
})();
