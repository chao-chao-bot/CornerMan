import { BadRequestException } from "@nestjs/common";
import type {
  TemplateBlock,
  TemplateBlockType,
  TemplateSchema
} from "@cornerman/shared-types";

const BLOCK_TYPES: TemplateBlockType[] = [
  "rich_text",
  "short_text",
  "rating",
  "checklist",
  "media_reference"
];

/**
 * 运行时校验模板 schema：
 * - blocks 非空数组
 * - 每个 block.id 非空且唯一
 * - block.type 合法
 * - block.title 非空
 * 非法抛 BadRequestException。返回规整后的 schema。
 */
export function validateTemplateSchema(raw: unknown): TemplateSchema {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestException("模板 schema 不能为空");
  }
  const schema = raw as Partial<TemplateSchema>;
  const version =
    typeof schema.version === "number" && schema.version > 0
      ? schema.version
      : 1;

  if (!Array.isArray(schema.blocks) || schema.blocks.length === 0) {
    throw new BadRequestException("模板至少需要一个 block");
  }

  const seen = new Set<string>();
  const blocks: TemplateBlock[] = schema.blocks.map((b, idx) => {
    if (!b || typeof b !== "object") {
      throw new BadRequestException(`第 ${idx + 1} 个 block 格式非法`);
    }
    const block = b as Partial<TemplateBlock>;
    if (!block.id || typeof block.id !== "string") {
      throw new BadRequestException(`第 ${idx + 1} 个 block 缺少 id`);
    }
    if (seen.has(block.id)) {
      throw new BadRequestException(`block id 重复：${block.id}`);
    }
    seen.add(block.id);
    if (!block.type || !BLOCK_TYPES.includes(block.type)) {
      throw new BadRequestException(`block ${block.id} 的 type 非法`);
    }
    if (!block.title || typeof block.title !== "string") {
      throw new BadRequestException(`block ${block.id} 缺少 title`);
    }
    return {
      id: block.id,
      type: block.type,
      title: block.title,
      placeholder: block.placeholder,
      description: block.description,
      required: block.required ?? false
    };
  });

  return { version, blocks };
}
