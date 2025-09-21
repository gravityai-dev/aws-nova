import { createPlugin, type GravityPluginAPI } from "@gravityai-dev/plugin-base";
import packageJson from "../package.json";

const plugin = createPlugin({
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,

  async setup(api: GravityPluginAPI) {
    // Initialize platform dependencies
    const { initializePlatformFromAPI } = await import("@gravityai-dev/plugin-base");
    initializePlatformFromAPI(api);

    // Import and register NovaSpeech node (using refactored version)
    const { NovaSpeechNode } = await import("./Nova/node");
    api.registerNode(NovaSpeechNode);

    // Import and register AWS credential (will use existing if already registered)
    const { AWSCredential } = await import("./credentials");
    api.registerCredential(AWSCredential);
  },
});

export default plugin;
