import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
export default function Home() { return <main className="landing min-h-screen"><div className="landing-theme"><ThemeToggle /></div><img className="landing-logo" src="/atlas-logo.png" alt="Project Atlas" /><p>PROJECT ATLAS</p><h1>Education planning, with a clearer view ahead.</h1><Link className="button primary" href="/scenario-lab">Open Scenario Lab →</Link></main>; }
