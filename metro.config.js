const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const purchasesRoot = path.resolve(__dirname, "packages/purchases");

config.watchFolders = [...(config.watchFolders ?? []), purchasesRoot];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@internal/purchases": purchasesRoot,
};

module.exports = config;
