import Link from 'next/link';
import AtlasNav from '@/components/AtlasNav';
import InstructionEditor from '@/components/InstructionEditor';
export default function AgentFrameworkPage() {
  return <main className="framework-shell"><AtlasNav compact/><header className="framework-header"><div><span className="eyebrow">ATLAS GOVERNANCE · CONFIGURATION</span><h1>Agent Framework</h1><p>Version the instructions used by every DepEd planning run.</p><Link href="/planning">Open planning workspace</Link></div></header><InstructionEditor/></main>;
}
