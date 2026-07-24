import type { Metadata } from "next";

import { ReportExperience } from "@/components/report/report-experience";

export const metadata: Metadata = {
  title: "你的 Steam 游戏星系 · WHERE DID THE HOURS GO?",
  description: "探索公开 Steam 库中按累计游玩时长生成的互动游戏星系。",
};

export default function ReportPage() {
  return <ReportExperience />;
}
