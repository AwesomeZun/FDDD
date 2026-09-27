// Lossless bitset of every computed cell's spike flag, sorted-engine index, LSB first.
export function packSpikes(flags){const bits=new Uint8Array(Math.ceil(flags.length/8));for(let i=0;i<flags.length;i++)if(flags[i])bits[i>>3]|=1<<(i&7);return bits;}
