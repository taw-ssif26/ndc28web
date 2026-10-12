// Full-screen loader. Used ONLY on the public page and the student portal (never in /admin).
// Add a kind: [caption, animation family f1..f5, hue-rotate degrees]
const KINDS = { intro: ["Diligite Lumen Sapientiae", "f1", "0deg"], dash: ["Gathering your day", "f2", "280deg"], events: ["Aligning the calendar", "f2", "330deg"],
  notices: ["Ringing the bell", "f1", "40deg"], community: ["Linking your batch", "f3", "160deg"], resources: ["Stacking the library", "f4", "25deg"], gallery: ["Developing memories", "f5", "300deg"], apply: ["Preparing your application", "f3", "200deg"] };
export default function Loader({ kind = "intro" }) {
  const [text, fam, hue] = KINDS[kind] || KINDS.intro;
  return (<div className="ld"><img src="/logo.svg" alt="" /><div className={`st ${fam}`} style={{ "--h": hue }}>{[0, 1, 2, 3, 4].map(n => <i key={n} style={{ "--n": n }} />)}</div><p>{text}</p></div>);
}
