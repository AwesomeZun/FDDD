/** Shared authored preview path, not a biological or connectome-driven flight model. */
export function flightPose(time:number){const t=time*.65;return {position:[.52*Math.sin(t),.14*Math.sin(2*t),.36*Math.cos(t)] as [number,number,number],yaw:Math.atan2(.52*Math.cos(t),-.36*Math.sin(t)),pitch:.13*Math.cos(2*t),roll:-.14-.035*Math.cos(t)};}
