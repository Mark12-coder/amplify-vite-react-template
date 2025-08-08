import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useAuthenticator } from "@aws-amplify/ui-react";

const client = generateClient<Schema>();

function formatDateLocal(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function App() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [selectedDay, setSelectedDay] = useState<string>(formatDateLocal(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()));
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState({ title: "", description: "", fromTime: "", toTime: "", allDay: false });
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);

  const { signOut } = useAuthenticator();

  // Subscribe to todos
  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const totalDays = daysInMonth(currentYear, currentMonth);

  async function createTodo() {
    if (!popupData.title.trim()) {
      alert("Title is required");
      return;
    }
    await client.models.Todo.create({
      title: popupData.title.trim(),
      description: popupData.description.trim() || undefined,
      date: selectedDay,
      fromTime: popupData.allDay ? undefined : popupData.fromTime || undefined,
      toTime: popupData.allDay ? undefined : popupData.toTime || undefined,
      allDay: popupData.allDay,
    });
    setShowPopup(false);
    setPopupData({ title: "", description: "", fromTime: "", toTime: "", allDay: false });
  }

  async function deleteTodo(id: string) {
    await client.models.Todo.delete({ id });
  }

  const filteredTodos = todos.filter((t) => t.date === selectedDay);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h1>📅 My Calendar Todos</h1>

      {/* Calendar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "20px" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ fontWeight: "bold", textAlign: "center" }}>{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={"empty-" + i}></div>)}
        {Array.from({ length: totalDays }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = formatDateLocal(currentYear, currentMonth, dayNum);
          const isSelected = selectedDay === dateStr;
          return (
            <div
              key={dayNum}
              onClick={() => setSelectedDay(dateStr)}
              style={{
                padding: "10px",
                textAlign: "center",
                borderRadius: "8px",
                cursor: "pointer",
                background: isSelected ? "#4f46e5" : "#f3f4f6",
                color: isSelected ? "white" : "black"
              }}
            >
              {dayNum}
            </div>
          );
        })}
      </div>

      {/* Todos for selected day */}
      <h2>Tasks for {selectedDay}</h2>
      <button onClick={() => setShowPopup(true)}>+ Add Todo</button>
      <div style={{ marginTop: "10px" }}>
        {filteredTodos.length === 0 && <p>No tasks for this day.</p>}
        {filteredTodos.map((todo) => (
          <div key={todo.id} style={{ background: "#e5e7eb", padding: "10px", borderRadius: "8px", marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{todo.title}</strong>
              <div>
                <button onClick={() => setExpandedTodo(expandedTodo === todo.id ? null : todo.id)}>
                  {expandedTodo === todo.id ? "Hide Details" : "View More"}
                </button>
                <button style={{ marginLeft: "5px" }} onClick={() => deleteTodo(todo.id)}>Delete</button>
              </div>
            </div>
            {expandedTodo === todo.id && (
              <div style={{ marginTop: "8px", background: "#f9fafb", padding: "8px", borderRadius: "6px" }}>
                <p><strong>Description:</strong> {todo.description || "No description"}</p>
                {todo.allDay ? (
                  <p><strong>All Day</strong></p>
                ) : (
                  <p><strong>From:</strong> {todo.fromTime} <strong>To:</strong> {todo.toTime}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Popup */}
      {showPopup && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{ background: "white", padding: "20px", borderRadius: "10px", width: "300px" }}>
            <h3>Add Todo for {selectedDay}</h3>
            <input
              placeholder="Title"
              value={popupData.title}
              onChange={(e) => setPopupData({ ...popupData, title: e.target.value })}
              style={{ width: "100%", marginBottom: "8px" }}
            />
            <textarea
              placeholder="Description"
              value={popupData.description}
              onChange={(e) => setPopupData({ ...popupData, description: e.target.value })}
              style={{ width: "100%", marginBottom: "8px" }}
            />
            <label>
              <input
                type="checkbox"
                checked={popupData.allDay}
                onChange={(e) => setPopupData({ ...popupData, allDay: e.target.checked })}
              /> All Day
            </label>
            {!popupData.allDay && (
              <>
                <input
                  type="time"
                  value={popupData.fromTime}
                  onChange={(e) => setPopupData({ ...popupData, fromTime: e.target.value })}
                  style={{ width: "100%", margin: "5px 0" }}
                />
                <input
                  type="time"
                  value={popupData.toTime}
                  onChange={(e) => setPopupData({ ...popupData, toTime: e.target.value })}
                  style={{ width: "100%", marginBottom: "8px" }}
                />
              </>
            )}
            <div style={{ marginTop: "10px" }}>
              <button onClick={createTodo}>Save</button>
              <button onClick={() => setShowPopup(false)} style={{ marginLeft: "5px" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <button onClick={signOut}>Sign out</button>
      </div>
    </main>
  );
}

export default App;
