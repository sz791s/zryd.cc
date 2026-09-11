import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { frameRegistry } from "./quartz/components/frames/registry"
import { JournalFrame } from "./quartz/components/frames/JournalFrame"

frameRegistry.register("journal", JournalFrame, "zryd.cc")

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
