import {LocalTime} from '@/components/local-time';

export type UserJourneyEvent={event_type:string;target:string|null;occurred_at:string;active_seconds:number};
const pages:Record<string,string>={landing:'Landing page',guest:'Guest trial entry',auth:'Sign-in page',app:'Main screen',onboarding:'Workout setup'};
const areas:Record<string,string>={overview:'Overview',workouts:'Workouts',progress:'Progress',logs:'Logs',library:'Library'};
const clicks:Record<string,string>={account_create:'Started account creation',account_menu:'Opened account menu',auth_email_request:'Requested email sign-in',auth_email_verify:'Verified email sign-in',auth_google:'Selected Google sign-in',auth_try_guest:'Selected guest access',landing_sign_in:'Selected sign-in',hero_try_free:'Selected Try Stride free',footer_try_free:'Selected Try Stride free',browser_history_navigation:'Navigated browser history',area_overview:'Opened Overview',area_workouts:'Opened Workouts',area_progress:'Opened Progress',area_logs:'Opened Logs',area_library:'Opened Library',onboarding_coach_requested:'Asked the coach to build a starting point',onboarding_coach_ready:'Coach returned a starting point',onboarding_coach_error:'Coach request failed',onboarding_setup_saved:'Saved setup and started logging',onboarding_setup_saved_with_plan:'Saved setup with a workout plan',onboarding_start_logging:'Chose direct workout logging',onboarding_skip_coach:'Skipped coaching and opened profile setup',onboarding_back_to_brief:'Returned to training brief',onboarding_mode_coach:'Chose guided setup',onboarding_mode_routine:'Chose an existing routine',onboarding_mode_manual:'Chose manual setup',onboarding_stage_brief:'Viewed training setup',onboarding_stage_review:'Viewed starting point and profile setup',workout_started:'Started a workout',workout_first_set:'Logged a set',workout_completed:'Finished a workout'};
function pageName(value:string|null){if(!value)return 'page';if(value.startsWith('area_'))return areas[value.slice(5)]||value.slice(5);if(value.startsWith('dialog_'))return `the ${value.slice(7).replaceAll('_',' ')} dialog`;if(value.startsWith('logs_'))return `Logs · ${value.slice(5)}`;return pages[value]||value.replaceAll('_',' ')}
function eventLabel(event:UserJourneyEvent){
 if(event.event_type==='page_view')return `Opened ${pageName(event.target)}`;
 if(event.event_type==='page_time')return `Active on ${pageName(event.target)} for ${event.active_seconds} sec`;
 if(event.event_type==='try_guest')return 'Started a guest account';
 if(event.event_type==='account_created')return 'Created an account';
 if(event.event_type==='scroll')return `Scrolled to ${event.target||0}%`;
 if(event.event_type==='click')return clicks[event.target||'']||`Selected ${pageName(event.target)}`;
 return 'Other activity';
}
export function AdminUserJourney({events}:{events:UserJourneyEvent[]}){
 const latest=events[0];
 return <details className="admin-user-journey"><summary>{latest?`Recent journey · ${eventLabel(latest)}`:'Account journey · no tracked actions yet'}</summary>{events.length?<ol>{events.map((event,index)=><li key={`${event.occurred_at}-${event.event_type}-${index}`}><span>{eventLabel(event)}</span><time><LocalTime value={event.occurred_at}/></time></li>)}</ol>:<p>New screen visits and setup actions will appear here after this account uses the updated tracker.</p>}<small>Actions show screen visits and setup milestones. Text entered into fields and workout details are not tracked here.</small></details>;
}
