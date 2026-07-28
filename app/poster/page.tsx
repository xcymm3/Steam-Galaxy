import type { Metadata } from "next";

import { GalaxyPosterExperience } from "@/components/report/galaxy-poster";

export const metadata: Metadata = {
  title: "Steam 星系海报 · Steam Galaxy",
  description: "将你的 Steam 游戏星系整理为可分享的个人宇宙档案。",
};

export default function PosterPage() {
  return <GalaxyPosterExperience />;
}
