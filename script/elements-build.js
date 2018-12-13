const fs = require("fs-extra");
const concat = require("concat");
const targetDir = "projects/webcomponentdemo";

(async function build() {
  // De gegenereerde javascript files samenvoegen om tot een eenvoudiger distributie te komen
  const files = [
    "./dist/webcomponent/runtime.js",
    "./dist/webcomponent/polyfills.js",
    // "./dist/webcomponent/scripts.js",
    "./dist/webcomponent/main.js"
  ];

  await fs.ensureDir(targetDir);
  await concat(files, targetDir + "/webcomponent.js");

  // Ook de style file copieren
  await fs.copyFile(
    "./dist/webcomponent/styles.css",
    targetDir + "/styles.css"
  );
})();
