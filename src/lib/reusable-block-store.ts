import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  deleteApiReusableBlock,
  listApiReusableBlocks,
  saveApiReusableBlock,
} from "./builder-api";
import type {
  ReusableBlock,
  ReusableBlockInput,
  ReusableBlockKind,
} from "./reusable-blocks";

const storePath = path.join(process.cwd(), "data", "custom-blocks.json");

async function readFallbackBlocks(): Promise<ReusableBlock[]> {
  try {
    const raw = await readFile(storePath, "utf8");
    return JSON.parse(raw) as ReusableBlock[];
  } catch {
    return [];
  }
}

async function writeFallbackBlocks(blocks: ReusableBlock[]) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(blocks, null, 2)}\n`, "utf8");
}

export async function listReusableBlocks(kind?: ReusableBlockKind) {
  const apiBlocks = await listApiReusableBlocks(kind);

  if (apiBlocks) {
    return apiBlocks;
  }

  const blocks = await readFallbackBlocks();
  return kind ? blocks.filter((block) => block.kind === kind) : blocks;
}

export async function saveReusableBlock(input: ReusableBlockInput) {
  const apiBlock = await saveApiReusableBlock(input);

  if (apiBlock) {
    return apiBlock;
  }

  const now = new Date().toISOString();
  const block: ReusableBlock = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const blocks = await readFallbackBlocks();
  blocks.push(block);
  await writeFallbackBlocks(blocks);

  return block;
}

export async function removeReusableBlock(blockId: string) {
  const removedFromApi = await deleteApiReusableBlock(blockId);

  if (removedFromApi) {
    return true;
  }

  const blocks = await readFallbackBlocks();
  const nextBlocks = blocks.filter((block) => block.id !== blockId);
  await writeFallbackBlocks(nextBlocks);

  return nextBlocks.length !== blocks.length;
}

