const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const purchasesRoot = path.resolve(__dirname, "packages/purchases");
const visionRoot = path.resolve(__dirname, "modules/memento-vision");

config.watchFolders = [...(config.watchFolders ?? []), purchasesRoot, visionRoot];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@internal/purchases": purchasesRoot,
  "memento-vision": visionRoot,
};

module.exports = config;
