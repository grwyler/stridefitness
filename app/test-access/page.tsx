import {TestAccessForm} from '@/components/test-access-form';
export const dynamic='force-dynamic';
export default function TestAccess(){return <main className="signin-page"><section className="signin-card"><span className="eyebrow">STRIDE DEMO ACCOUNT</span><h1>Open test workspace</h1><p>Sign in with the reviewer credentials to open synthetic workout and nutrition data. Changes stay in the isolated demo workspace and never affect a personal Stride account.</p><TestAccessForm/></section></main>}
