/**
 * 系统模板 seed（幂等）。
 * 用固定 id + upsert 写入三套系统模板（isSystem=true, userId=null），
 * blocks 对齐 docs/prd.md §7。重复执行只更新内容，不产生重复行。
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type SystemTemplate = {
  id: string;
  name: string;
  scene: string;
  description: string;
  schema: Prisma.InputJsonValue;
};

const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    id: "tpl_system_private_lesson",
    name: "私教课复盘",
    scene: "private_lesson",
    description: "教练指导与纠错（适合固定私教日，如周二、周五）",
    schema: {
      version: 1,
      blocks: [
        {
          id: "coach_correction",
          type: "rich_text",
          title: "教练重点纠错",
          placeholder: "记录教练指出的问题、改法和关键词",
          required: true
        },
        {
          id: "new_technique",
          type: "rich_text",
          title: "今日新学技术",
          placeholder: "新学的动作 / 组合 / 发力要点"
        },
        {
          id: "summary",
          type: "rich_text",
          title: "课后总结",
          placeholder: "整体感受、下次重点"
        }
      ]
    }
  },
  {
    id: "tpl_system_sparring",
    name: "实战复盘",
    scene: "sparring",
    description: "约练 / 实战 / 对抗日（如周三）",
    schema: {
      version: 1,
      blocks: [
        {
          id: "opponent_style",
          type: "rich_text",
          title: "对手风格分析",
          placeholder: "对手的节奏、距离、惯用拳路"
        },
        {
          id: "defense_holes",
          type: "rich_text",
          title: "暴露的防守漏洞",
          placeholder: "被打到的瞬间、回防慢的位置",
          required: true
        },
        {
          id: "highlights",
          type: "rich_text",
          title: "有效打击与高光时刻",
          placeholder: "打得好的组合、成功的防反"
        },
        {
          id: "conditioning",
          type: "rating",
          title: "体能消耗评估",
          description: "1-10 分主观体能消耗"
        }
      ]
    }
  },
  {
    id: "tpl_system_self_training",
    name: "自训复盘",
    scene: "self_training",
    description: "个人空击、沙袋、专项训练",
    schema: {
      version: 1,
      blocks: [
        {
          id: "warmup_shadow",
          type: "rich_text",
          title: "热身 / 空击组数",
          placeholder: "热身内容、空击组数与重点"
        },
        {
          id: "bag_drills",
          type: "rich_text",
          title: "沙袋 / 专项训练内容",
          placeholder: "沙袋组合、专项训练项目"
        },
        {
          id: "body_feel",
          type: "rich_text",
          title: "自我身体感受",
          placeholder: "状态、疲劳、酸痛点"
        }
      ]
    }
  }
];

async function main() {
  for (const tpl of SYSTEM_TEMPLATES) {
    await prisma.template.upsert({
      where: { id: tpl.id },
      update: {
        name: tpl.name,
        scene: tpl.scene,
        description: tpl.description,
        schema: tpl.schema,
        isSystem: true,
        userId: null,
        deletedAt: null
      },
      create: {
        id: tpl.id,
        name: tpl.name,
        scene: tpl.scene,
        description: tpl.description,
        schema: tpl.schema,
        isSystem: true,
        version: 1
      }
    });
    console.log(`seeded system template: ${tpl.id} (${tpl.name})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
