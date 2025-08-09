import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      title: a.string().required(),                   // Task title
      description: a.string().required(),              // Task details
      date: a.string(),                     // yyyy-mm-dd
      startTime: a.string(), // e.g., 14:30
      endTime: a.string()    , // e.g., 15:30
      allDay: a.boolean().default(false),   // All-day event
      priority: a.string(),    // Low, Medium, High
      category: a.string(), // Work, Personal, etc.
      recurring: a.string(),   // None, Daily, Weekly...
      reminderOffsets: a.string().array(), // ["10", "30", "60"] = minutes before start
      completed: a.boolean().default(false),
      unplanned: a.boolean().default(false),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
