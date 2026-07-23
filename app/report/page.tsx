import type { Metadata } from "next";

import { ReportExperience } from "@/components/report/report-experience";

export const metadata: Metadata = {
  title: "你的 Steam 生涯报告 · WHERE DID THE HOURS GO?",
  description: "用十页故事浏览公开 Steam 游戏数据形成的生涯快照。",
};

export default function ReportPage() {
  return <ReportExperience />;
}
