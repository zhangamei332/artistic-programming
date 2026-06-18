import type {
  RenamePreset,
} from "../model/types.js";

export const builtInRenamePresets:
  RenamePreset[] = [
  {
    id: "number-files",
    name: "序号文件",
    description:
      "在原文件名前增加三位序号。",
    rules: [
      {
        id: "preset_number",
        variant: "sequence",
        enabled: true,
        position: "prefix",
        start: 1,
        step: 1,
        padding: 3,
        separator: "_",
        format: "{index}",
      },
    ],
  },
  {
    id: "date-prefix",
    name: "日期前缀",
    description:
      "在文件名前增加当前日期。",
    rules: [
      {
        id: "preset_date",
        variant: "dateTime",
        enabled: true,
        source: "current",
        format: "YYYY-MM-DD",
        position: "prefix",
        separator: "_",
      },
    ],
  },
  {
    id: "clean-lowercase",
    name: "清理并小写",
    description:
      "清理空格和重复分隔符，然后转为小写。",
    rules: [
      {
        id: "preset_cleanup",
        variant: "cleanup",
        enabled: true,
        trimSpaces: true,
        collapseSpaces: true,
        removeCharacters:
          "!@#$%^&*()+=[]{}|;:'\",<>?`~",
        replaceSpacesWith: "_",
        removeRepeatedSeparators: true,
      },
      {
        id: "preset_lowercase",
        variant: "caseStyle",
        enabled: true,
        style: "lowercase",
      },
    ],
  },
  {
    id: "project-sequence",
    name: "项目序号",
    description:
      "生成 project_001、project_002。",
    rules: [
      {
        id: "preset_project",
        variant: "template",
        enabled: true,
        template:
          "project_{index:000}",
        start: 1,
        step: 1,
      },
    ],
  },
  {
    id: "lowercase-extension",
    name: "扩展名小写",
    description:
      "只将文件扩展名转为小写。",
    rules: [
      {
        id: "preset_extension_lower",
        variant: "extension",
        enabled: true,
        action: "lowercase",
        extension: "",
      },
    ],
  },
];
