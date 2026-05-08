/** Shared View Setting popover (Figma 100:13382). Backed by per-page
 *  WEB_SVC_ID (e.g. "fnsh_0001_001") via /api/v1/screen-options. */
export { default as ViewSettingPopover } from "./ViewSettingPopover";
export {
    useViewSetting,
    isSpecialViewSettingField,
    VIEW_SETTING_SPECIAL_FIELD_IDS,
} from "./useViewSetting";
export type { ViewSettingItem, UseViewSettingState } from "./useViewSetting";
