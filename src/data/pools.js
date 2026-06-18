// Hardcoded pool schedule data — will be replaced by live scraped data
export const POOLS = [
  { id: 'west-campus', name: 'West Campus Pool', city: 'Berkeley' },
  { id: 'emeryville', name: 'Emeryville ECCL', city: 'Emeryville' },
  { id: 'albany-indoor', name: 'Albany · Indoor Pool', city: 'Albany' },
  { id: 'albany-outdoor', name: 'Albany · Outdoor Pool', city: 'Albany' },
  { id: 'golden-bear', name: 'Golden Bear Pool', city: 'Berkeley' },
  { id: 'golden-bear-strawberry', name: 'Strawberry Canyon Pool', city: 'Berkeley' },
  { id: 'richmond', name: 'Richmond Plunge', city: 'Richmond' },
  { id: 'king', name: 'King Pool', city: 'Berkeley' },
  { id: 'piedmont', name: 'Piedmont Community Pool', city: 'Piedmont' },
];

// Session type labels per pool (so we can show tooltips)
export const SESSION_TYPES = {
  'lap': 'Lap Swim',
  'family': 'Family Swim',
  'rec': 'Rec Swim',
  'community': 'Community Swim',
  'tot': 'Tot Swim',
  'open': 'Open Swim',
};

// Sample schedule data for today — will be replaced by live data
// Format: { time, endTime, type, poolId, notes }
export const SAMPLE_SCHEDULE = [
  { time: '6:00 AM', endTime: '8:00 AM', type: 'lap', poolId: 'west-campus' },
  { time: '6:00 AM', endTime: '7:30 AM', type: 'lap', poolId: 'golden-bear' },
  { time: '6:30 AM', endTime: '8:30 AM', type: 'lap', poolId: 'emeryville' },
  { time: '7:00 AM', endTime: '9:00 AM', type: 'lap', poolId: 'albany-indoor' },
  { time: '8:00 AM', endTime: '10:00 AM', type: 'lap', poolId: 'west-campus' },
  { time: '8:00 AM', endTime: '9:30 AM', type: 'lap', poolId: 'richmond' },
  { time: '9:00 AM', endTime: '11:00 AM', type: 'family', poolId: 'albany-outdoor' },
  { time: '9:00 AM', endTime: '10:30 AM', type: 'community', poolId: 'west-campus', notes: 'Shared with lessons' },
  { time: '10:00 AM', endTime: '12:00 PM', type: 'lap', poolId: 'emeryville' },
  { time: '10:00 AM', endTime: '11:30 AM', type: 'family', poolId: 'richmond' },
  { time: '11:00 AM', endTime: '1:00 PM', type: 'lap', poolId: 'golden-bear' },
  { time: '11:30 AM', endTime: '1:00 PM', type: 'rec', poolId: 'albany-indoor' },
  { time: '12:00 PM', endTime: '2:00 PM', type: 'lap', poolId: 'west-campus' },
  { time: '12:00 PM', endTime: '1:30 PM', type: 'family', poolId: 'emeryville' },
  { time: '1:00 PM', endTime: '3:00 PM', type: 'lap', poolId: 'king' },
  { time: '2:00 PM', endTime: '4:00 PM', type: 'family', poolId: 'west-campus' },
  { time: '3:00 PM', endTime: '5:00 PM', type: 'lap', poolId: 'emeryville' },
  { time: '3:30 PM', endTime: '5:30 PM', type: 'lap', poolId: 'golden-bear' },
  { time: '4:00 PM', endTime: '6:00 PM', type: 'lap', poolId: 'west-campus' },
  { time: '4:30 PM', endTime: '6:00 PM', type: 'family', poolId: 'albany-indoor' },
  { time: '5:00 PM', endTime: '7:00 PM', type: 'lap', poolId: 'king' },
  { time: '6:00 PM', endTime: '8:00 PM', type: 'lap', poolId: 'richmond' },
  { time: '6:30 PM', endTime: '8:00 PM', type: 'lap', poolId: 'emeryville' },
  { time: '7:00 PM', endTime: '8:30 PM', type: 'lap', poolId: 'west-campus' },
];
