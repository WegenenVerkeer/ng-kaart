const fs = require("fs-extra");
const concat = require("concat");
const targetDir = "dist/webcomponent";

(async function build() {
  // De gegenereerde javascript files samenvoegen om tot een eenvoudiger distributie te komen
  const files = [
    "./dist/webcomponent/runtime.js",
    "./dist/webcomponent/polyfills.js",
    "./dist/webcomponent/main.js"
  ];

  await fs.ensureDir(targetDir);
  await concat(files, targetDir + "/ng-kaart-webcomponent.js");

  await fs.copyFile(
    "./projects/webcomponent/package.json",
    targetDir + "/package.json"
  );
  await fs.copyFile(
    "./docs/client-developer-guide-tutorial/0002-webcomponent.md",
    targetDir + "/README.md"
  );

  // Verwijder de originele files
  for (const file of files) {
    await fs.unlink(file);
  }
  await fs.unlink("./dist/webcomponent/favicon.ico");
  await fs.unlink("./dist/webcomponent/index.html");
})();
