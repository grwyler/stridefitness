'use client';
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

type Hour={hour:number;active_users:number};
const hourLabel=(hour:number)=>`${hour%12||12} ${hour<12?'AM':'PM'}`;

export function AdminHourlyActivityChart({data}:{data:Hour[]}){
 const chartData=data.map(row=>({...row,label:hourLabel(row.hour)}));
 return <div className="landing-active-chart" role="img" aria-label="Bar chart of unique active users for each hour today, in New York local time">
  <ResponsiveContainer width="100%" height="100%">
   <BarChart data={chartData} margin={{top:8,right:8,left:-20,bottom:0}} accessibilityLayer>
    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false}/>
    <XAxis dataKey="label" interval={3} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'var(--muted-foreground)'}}/>
    <YAxis allowDecimals={false} width={38} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'var(--muted-foreground)'}}/>
    <Tooltip labelFormatter={label=>`${label} local time`} formatter={value=>[`${value} active users`,'Unique sessions']}/>
    <Bar dataKey="active_users" name="Unique sessions" fill="var(--primary)" radius={[3,3,0,0]} maxBarSize={24} isAnimationActive={false}/>
   </BarChart>
  </ResponsiveContainer>
 </div>;
}
