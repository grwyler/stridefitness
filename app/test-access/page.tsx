import {TestAccessForm} from '@/components/test-access-form';
export const dynamic='force-dynamic';
export default function TestAccess(){return <main className="signin-page"><section className="signin-card"><span className="eyebrow">PRIVATE TESTING</span><h1>Open test workspace</h1><p>Use the private test access code to open a disposable Stride session. This does not grant owner or admin access.</p><TestAccessForm/></section></main>}
