import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      title: a.string().required(),                  
      description: a.string().required(),              
      date: a.string(),
      startTime: a.string(),
      endTime: a.string(),
      allDay: a.boolean().default(false),   
      priority: a.enum(["High", "Medium", "Low"]),
      recurring: a.string(),   
      reminderTimes: a.string().array(), 
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
