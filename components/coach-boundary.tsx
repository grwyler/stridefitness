 'use client';
import {Component,type ReactNode} from 'react';
export class CoachBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?<div className="notice" role="alert">This coach response could not be displayed. Your account and pending actions are safe.<button className="text-button" onClick={()=>this.setState({failed:false})}>Try displaying again</button></div>:this.props.children}}
