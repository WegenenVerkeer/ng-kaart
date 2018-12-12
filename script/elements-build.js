const fs = require("fs-extra");
const concat = require("concat");
const targetDir =  "dist/elements";

(async function build() {
  const files = [
    "./dist/webcomponent/runtime.js",
    "./dist/webcomponent/polyfills.js",
    // "./dist/webcomponent/scripts.js",
    "./dist/webcomponent/main.js"
  ];

  await fs.ensureDir(targetDir);
  await concat(files, targetDir + "/webcomponent.js");
  await fs.copyFile(
    "./dist/webcomponent/styles.css",
    targetDir + "/styles.css"
  );
})();
