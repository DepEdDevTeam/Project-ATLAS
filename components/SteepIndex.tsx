import { Cpu, Landmark, Leaf, TrendingUp, Users } from "lucide-react";

const groups = [
  { name: "Social", Icon: Users, text: "Population, poverty, health, nutrition, education, housing and social protection." },
  { name: "Technological", Icon: Cpu, text: "Digital access, ICT infrastructure, adoption, innovation and technology spending." },
  { name: "Economic", Icon: TrendingUp, text: "Work, income, prices, trade, agriculture, industry, budgets and investment." },
  { name: "Environmental", Icon: Leaf, text: "Climate, hazards, disasters, natural resources, food security and resilience." },
  { name: "Political / Policy", Icon: Landmark, text: "Programs, appropriations, agencies, public projects and implementation." },
];

export default function SteepIndex() {
  return <section className="steep-index" aria-labelledby="steep-heading"><div className="section-copy"><h2 id="steep-heading">Browse through a STEEP lens</h2><p>One shared vocabulary keeps very different datasets understandable without forcing them into one formula.</p></div><div className="steep-rail">{groups.map(({ name, Icon, text }) => <article key={name}><Icon size={19} /><h3>{name}</h3><p>{text}</p></article>)}</div></section>;
}
