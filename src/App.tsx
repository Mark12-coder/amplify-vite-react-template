import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useAuthenticator } from "@aws-amplify/ui-react";

const client = generateClient<Schema>();

function formatDateLocal(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function timeStringToMinutes(time: string) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isReminderUpcoming(todo: Schema["Todo"]["type"]) {
  if (!todo.date || (todo.reminderTimes ?? []).length === 0) return false;
  const now = new Date();
  const todayStr = formatDateLocal(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (todo.date < todayStr) return false;

  const eventStart = todo.allDay ? 0 : timeStringToMinutes(todo.startTime || "00:00");
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = eventStart - nowMinutes;

  return (todo.reminderTimes ?? []).some((rStr) => {
    if (typeof rStr !== "string") return false;
    const reminderOffset = parseInt(rStr, 10);
    return diffMinutes <= Math.abs(reminderOffset) && diffMinutes > Math.abs(reminderOffset) - 1;
  });
}

function getTodayStr() {
  const now = new Date();
  return formatDateLocal(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export default function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(formatDateLocal(currentYear, currentMonth, 1));

  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    allDay: false,
    reminderTimes: [] as string[],
    isUnplanned: false,
    priority: "Medium" as "High" | "Medium" | "Low",
  });
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);

  const { signOut } = useAuthenticator();

  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: (data) => {
        const safeTodos = data.items.map(todo => ({
          ...todo,
          reminderTimes: (todo.reminderTimes ?? []).filter((r): r is string => r !== null),
          unplanned: todo.unplanned ?? false,
          description: todo.description ?? "",
          startTime: todo.startTime ?? null,
          endTime: todo.endTime ?? null,
          date: todo.date ?? null,
          priority: todo.priority ?? "Medium",
        }));
        setTodos(safeTodos);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  useEffect(() => {
    setSelectedDay(formatDateLocal(currentYear, currentMonth, 1));
  }, [currentYear, currentMonth]);

  function prevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(y => y - 1);
    } else setCurrentMonth(m => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(y => y + 1);
    } else setCurrentMonth(m => m + 1);
  }

  function prevYear() { setCurrentYear(y => y - 1); }
  function nextYear() { setCurrentYear(y => y + 1); }

  async function saveTodo() {
    if (!popupData.title.trim()) { alert("Title is required"); return; }

    const dataToSave = {
      title: popupData.title.trim(),
      description: popupData.description.trim() || "",
      date: popupData.isUnplanned ? null : selectedDay,
      startTime: popupData.allDay || popupData.isUnplanned ? null : popupData.startTime || null,
      endTime: popupData.allDay || popupData.isUnplanned ? null : popupData.endTime || null,
      allDay: popupData.allDay,
      reminderTimes:
        popupData.allDay
          ? ["-1440"]
          : popupData.reminderTimes.length > 0
            ? popupData.reminderTimes
            : [],
      unplanned: popupData.isUnplanned,
      priority: popupData.priority,
    };

    if (editingTodoId) await client.models.Todo.update({ id: editingTodoId, ...dataToSave });
    else await client.models.Todo.create(dataToSave);

    setShowPopup(false);
    setPopupData({ title: "", description: "", startTime: "", endTime: "", allDay: false, reminderTimes: [], isUnplanned: false, priority: "Medium" });
    setEditingTodoId(null);
  }

  async function deleteTodo(id: string) { await client.models.Todo.delete({ id }); }

  function editTodo(todo: Schema["Todo"]["type"]) {
    if (todo.unplanned) return;
    setPopupData({
      title: todo.title || "",
      description: todo.description || "",
      startTime: todo.startTime || "",
      endTime: todo.endTime || "",
      allDay: todo.allDay || false,
      reminderTimes: (todo.reminderTimes ?? []).filter((r): r is string => r !== null),
      isUnplanned: false,
      priority: todo.priority ?? "Medium",
    });
    setEditingTodoId(todo.id);
    setShowPopup(true);
  }

  function addUnplannedTodo() {
    setPopupData({ title: "", description: "", startTime: "", endTime: "", allDay: false, reminderTimes: [], isUnplanned: true, priority: "Medium" });
    setEditingTodoId(null);
    setShowPopup(true);
  }

  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const totalDays = daysInMonth(currentYear, currentMonth);
  const filteredTodos = todos.filter(t => t.date === selectedDay);
  const unplannedTodos = todos.filter(t => t.unplanned);
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const reminderLabels: Record<string,string> = { "-10":"10 minutes before","-30":"30 minutes before","-60":"1 hour before","-120":"2 hours before","-360":"6 hours before","-1440":"Day before"};
  const reminderOptions = [ { label:"10 minutes before", value:"-10" },{ label:"30 minutes before", value:"-30" },{ label:"1 hour before", value:"-60" },{ label:"2 hours before", value:"-120" },{ label:"6 hours before", value:"-360" } ];

  function toggleReminder(value: string) {
    setPopupData(prev => {
      const newReminders = prev.reminderTimes.includes(value)
        ? prev.reminderTimes.filter(r => r !== value)
        : [...prev.reminderTimes, value];
      return { ...prev, reminderTimes: newReminders };
    });
  }

  const todayStr = getTodayStr();
  const isTodaySelected = selectedDay === todayStr;
  const now = new Date();
  const currentTimeString = now.toTimeString().slice(0, 5);

  const priorityColors: Record<string,string> = { High:"#cf3333ff", Medium:"#24b7fbff", Low:"#34d399" };

  return (
    <div style={{ fontFamily:"sans-serif", padding:20, height:"100vh", boxSizing:"border-box" }}>
      <main style={{ overflowY:"auto", marginRight:280 }}>
        <h1>Events:</h1>
        {/* Year & Month Controls */}
        <div style={{ display:"flex", justifyContent:"center", gap:12, marginBottom:8 }}>
          <button onClick={prevYear}>← Prev Year</button>
          <div style={{ fontWeight:"bold", fontSize:"1.2rem", lineHeight:"32px" }}>{currentYear}</div>
          <button onClick={nextYear}>Next Year →</button>
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:12, marginBottom:20 }}>
          <button onClick={prevMonth}>← Prev Month</button>
          <div style={{ fontWeight:"bold", fontSize:"1.5rem", lineHeight:"36px" }}>{monthNames[currentMonth-1]}</div>
          <button onClick={nextMonth}>Next Month →</button>
        </div>

        {/* Calendar */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5, marginBottom:20, userSelect:"none" }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ fontWeight:"bold", textAlign:"center", padding:5, background:"#efefef", borderRadius:4 }}>{d}</div>
          ))}
          {Array.from({ length: 42 }).map((_,i)=>{
            const dayIndex = i-firstDayOfMonth+1;
            if(dayIndex<1 || dayIndex>totalDays) return <div key={"empty-"+i} style={{visibility:"hidden"}} />;
            const dateStr=formatDateLocal(currentYear,currentMonth,dayIndex);
            const isSelected = selectedDay===dateStr;
            const isPast = dateStr<todayStr;
            return (
              <div
                key={dayIndex}
                onClick={()=>!isPast && setSelectedDay(dateStr)}
                style={{
                  padding:10,
                  textAlign:"center",
                  borderRadius:8,
                  cursor:isPast?"default":"pointer",
                  background:isSelected?"#4f46e5":"#f3f4f6",
                  color:isSelected?"white":isPast?"#888":"black",
                  boxShadow:isSelected?"0 0 8px rgba(79,70,229,0.7)":"none",
                  userSelect:"none",
                  transition:"background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease"
                }}
                title={isPast?"Cannot select past dates":undefined}
              >{dayIndex}</div>
            )
          })}
        </div>

        <h2>Tasks for {selectedDay}</h2>
        <button
          onClick={()=>{
            if(selectedDay<todayStr){alert("Cannot add todos on past dates"); return;}
            setShowPopup(true);
            setEditingTodoId(null);
            setPopupData({title:"",description:"",startTime:"",endTime:"",allDay:false,reminderTimes:[],isUnplanned:false,priority:"Medium"});
          }}
          style={{
            padding:"8px 12px",
            backgroundColor:selectedDay<todayStr?"#aaa":"#4f46e5",
            color:"white",
            border:"none",
            borderRadius:6,
            cursor:selectedDay<todayStr?"not-allowed":"pointer",
            marginBottom:12
          }}
          disabled={selectedDay<todayStr}
        >
          + Add Todo
        </button>

        {filteredTodos.length===0 && <p>No tasks for this day.</p>}
        {filteredTodos.map(todo=>{
          const upcoming = isReminderUpcoming(todo);
          const bgColor = upcoming?"#fef3c7":priorityColors[todo.priority ?? "Medium"];
          return (
            <div key={todo.id} style={{ background:bgColor, padding:10, borderRadius:8, marginBottom:8, boxShadow:expandedTodo===todo.id?"0 4px 12px rgba(79,70,229,0.3)":undefined, border:upcoming?"2px solid #f59e0b":undefined, position:"relative" }}>
              {upcoming && <div style={{ position:"absolute", top:8,right:8, backgroundColor:"#f59e0b", borderRadius:"50%", width:16,height:16, boxShadow:"0 0 6px #fbbf24" }} />}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <strong>{todo.title}</strong>
                <div>
                  <button onClick={()=>setExpandedTodo(expandedTodo===todo.id?null:todo.id)} style={{ background:"transparent", border:"none", color:"#4f46e5", cursor:"pointer", fontWeight:600, marginRight:10 }}>{expandedTodo===todo.id?"Hide Details":"View More"}</button>
                  <button onClick={()=>editTodo(todo)} style={{ background:"transparent", border:"none", color:"#2563eb", cursor:"pointer", fontWeight:600, marginRight:10 }} title="Edit">Edit</button>
                  <button style={{ background:"transparent", border:"none", color:"red", cursor:"pointer", fontWeight:600 }} onClick={()=>deleteTodo(todo.id)}>Delete</button>
                </div>
              </div>
              {expandedTodo===todo.id && <div style={{ marginTop:8, background:"#f9fafb", padding:8, borderRadius:6 }}>
                <p><strong>Description:</strong> {todo.description || "No description"}</p>
                {todo.allDay ? <p><strong>All Day Event</strong></p> : <p><strong>From:</strong> {todo.startTime} <strong>To:</strong> {todo.endTime}</p>}
                {(todo.reminderTimes ?? []).length>0 && <p><strong>Reminders:</strong> {(todo.reminderTimes ?? []).map(r=>(r?reminderLabels[r]||r:"")).filter(Boolean).join(", ")}</p>}
                <p><strong>Priority:</strong> {todo.priority}</p>
              </div>}
            </div>
          )
        })}

        <button onClick={signOut} style={{ marginTop:20 }}>Sign Out</button>
      </main>

      {/* Unplanned Tasks Sidebar */}
      <aside style={{ width:260, position:"fixed", right:0, top:0, height:"100vh", borderLeft:"1px solid #ccc", padding:20, boxSizing:"border-box", overflowY:"auto", backgroundColor:"#f9fafb" }}>
        <h2>Unplanned Tasks</h2>
        <button onClick={addUnplannedTodo} style={{ padding:"8px 12px", backgroundColor:"#10b981", color:"white", border:"none", borderRadius:6, cursor:"pointer", marginBottom:12 }}>+ Add Unplanned Task</button>
        {unplannedTodos.length===0 && <p>No unplanned tasks.</p>}
        {unplannedTodos.map(todo=>(
          <div key={todo.id} style={{ padding:8, marginBottom:8, backgroundColor:"#d1fae5", borderRadius:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <strong>{todo.title}</strong>
              {todo.description && <p>{todo.description}</p>}
            </div>
            <button onClick={()=>todo.id && deleteTodo(todo.id)} style={{ background:"transparent", border:"none", color:"red", cursor:"pointer", fontWeight:600 }} title="Delete unplanned task">Delete</button>
          </div>
        ))}
      </aside>

      {/* Popup Form */}
      {showPopup && <div onClick={()=>setShowPopup(false)} style={{ position:"fixed", top:0,left:0,right:0,bottom:0, backgroundColor:"rgba(0,0,0,0.25)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:100 }}>
        <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:"white", padding:20, borderRadius:8, width:340, maxHeight:"80vh", overflowY:"auto", boxSizing:"border-box" }}>
          <h3>{editingTodoId?"Edit Todo":popupData.isUnplanned?"Add Unplanned Task":"Add Todo"}</h3>
          <label style={{ display:"block", marginBottom:8 }}>Title:
            <input type="text" value={popupData.title} onChange={e=>setPopupData(p=>({...p,title:e.target.value}))} style={{ width:"100%", padding:6, marginTop:4, boxSizing:"border-box" }} />
          </label>
          <label style={{ display:"block", marginBottom:8 }}>Description:
            <textarea value={popupData.description} onChange={e=>setPopupData(p=>({...p,description:e.target.value}))} style={{ width:"100%", padding:6, marginTop:4, boxSizing:"border-box", resize:"vertical" }} rows={3} />
          </label>

          {!popupData.isUnplanned && <>
            <label style={{ display:"block", marginBottom:8 }}><input type="checkbox" checked={popupData.allDay} onChange={e=>setPopupData(p=>({...p,allDay:e.target.checked}))} /> All Day Event</label>
            {!popupData.allDay && <>
              <label style={{ display:"block", marginBottom:8 }}>Start Time:
                <input type="time" value={popupData.startTime} min={isTodaySelected?currentTimeString:undefined} onChange={e=>setPopupData(p=>({...p,startTime:e.target.value}))} style={{ width:"100%", padding:6, marginTop:4, boxSizing:"border-box" }} />
              </label>
              <label style={{ display:"block", marginBottom:8 }}>End Time:
                <input type="time" value={popupData.endTime} min={isTodaySelected?currentTimeString:undefined} onChange={e=>setPopupData(p=>({...p,endTime:e.target.value}))} style={{ width:"100%", padding:6, marginTop:4, boxSizing:"border-box" }} />
              </label>
            </>}
            <fieldset style={{ border:"1px solid #ccc", padding:10, borderRadius:6, marginBottom:8 }}>
              <legend>Reminders</legend>
              {reminderOptions.map(({label,value})=>(
                <label key={value} style={{ display:"block", marginBottom:4 }}>
                  <input type="checkbox" checked={popupData.reminderTimes.includes(value)} onChange={()=>toggleReminder(value)} /> {label}
                </label>
              ))}
            </fieldset>
            <fieldset style={{ border:"1px solid #ccc", padding:10, borderRadius:6, marginBottom:8 }}>
              <legend>Priority</legend>
              {["High","Medium","Low"].map(p => (
                <label key={p} style={{ display:"block", marginBottom:4 }}>
                  <input type="radio" name="priority" value={p} checked={popupData.priority===p} onChange={()=>setPopupData(prev=>({...prev, priority:p as any}))} /> {p}
                </label>
              ))}
            </fieldset>
          </>}

          <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
            <button onClick={()=>setShowPopup(false)} style={{ backgroundColor:"#ccc", border:"none", padding:"6px 12px", borderRadius:6 }}>Cancel</button>
            <button onClick={saveTodo} style={{ backgroundColor:"#4f46e5", color:"white", border:"none", padding:"6px 12px", borderRadius:6 }}>Save</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
