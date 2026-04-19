import { Nanum_Pen_Script } from "next/font/google";

const nanumPen = Nanum_Pen_Script({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

/** Home route (/) — load Nanum Pen in this layout (not in client page). */
export default function HomeLayout({ children }) {
  return <div className={nanumPen.className}>{children}</div>;
}
