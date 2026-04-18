const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const { rcedit } = await import("rcedit");
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "assets", "icon.ico");

  await rcedit(exePath, {
    icon: iconPath,
    "version-string": {
      FileDescription: "DescarregApp",
      ProductName: "DescarregApp",
      CompanyName: "Felip Sarroca",
      LegalCopyright: "CC BY-NC-SA 4.0"
    }
  });
};
