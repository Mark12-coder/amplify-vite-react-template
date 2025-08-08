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

  // Track currently viewed calendar month/year
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

  // Selected day string in yyyy-mm-dd format
  const [selectedDay, setSelectedDay] = useState(
    formatDateLocal(currentYear, currentMonth, 1)
  );

  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState({
    title: "",
    description: "",
    fromTime: "",
    toTime: "",
    allDay: false,
  });
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);

  const { signOut } = useAuthenticator();

  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  // Utility: days in given month/year
  function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  // When month or year changes, reset selectedDay to first day of that month
  useEffect(() => {
    setSelectedDay(formatDateLocal(currentYear, currentMonth, 1));
  }, [currentYear, currentMonth]);

  // Navigation handlers
  function prevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function prevYear() {
    setCurrentYear((y) => y - 1);
  }

  function nextYear() {
    setCurrentYear((y) => y + 1);
  }

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

  // Calculate first day of month (0 = Sunday, 6 = Saturday)
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const totalDays = daysInMonth(currentYear, currentMonth);

  const filteredTodos = todos.filter((t) => t.date === selectedDay);

  // Month names for display
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <main style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h1>📅 My Calendar Todos</h1>

      {/* Year Navigation */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 8 }}>
        <button onClick={prevYear} style={{ padding: "6px 10px", cursor: "pointer" }}>← Prev Year</button>
        <div style={{ fontWeight: "bold", fontSize: "1.2rem", lineHeight: "32px" }}>{currentYear}</div>
        <button onClick={nextYear} style={{ padding: "6px 10px", cursor: "pointer" }}>Next Year →</button>
      </div>

      {/* Month Navigation */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ padding: "8px 12px", cursor: "pointer" }}>← Prev Month</button>
        <div style={{ fontWeight: "bold", fontSize: "1.5rem", lineHeight: "36px" }}>
          {monthNames[currentMonth - 1]}
        </div>
        <button onClick={nextMonth} style={{ padding: "8px 12px", cursor: "pointer" }}>Next Month →</button>
      </div>

      {/* Calendar grid with fixed 42 cells */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "5px",
          marginBottom: "20px",
          userSelect: "none",
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            style={{
              fontWeight: "bold",
              textAlign: "center",
              padding: "5px 0",
              background: "#efefef",
              borderRadius: "4px",
            }}
          >
            {d}
          </div>
        ))}

        {Array.from({ length: 42 }).map((_, i) => {
          const dayIndex = i - firstDayOfMonth + 1;
          if (dayIndex < 1 || dayIndex > totalDays) {
            return <div key={"empty-" + i} style={{ visibility: "hidden" }}></div>;
          }

          const dayNum = dayIndex;
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
                color: isSelected ? "white" : "black",
                boxShadow: isSelected
                  ? "0 0 8px rgba(79, 70, 229, 0.7)"
                  : "none",
                transition:
                  "background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "#ddd";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "#f3f4f6";
              }}
            >
              {dayNum}
            </div>
          );
        })}
      </div>

      {/* Todos for selected day */}
      <h2>Tasks for {selectedDay}</h2>
      <button
        onClick={() => setShowPopup(true)}
        style={{
          padding: "8px 12px",
          backgroundColor: "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          transition: "background-color 0.3s ease",
          marginBottom: "12px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338ca")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
      >
        + Add Todo
      </button>
      <div>
        {filteredTodos.length === 0 && <p>No tasks for this day.</p>}
        {filteredTodos.map((todo) => (
          <div
            key={todo.id}
            style={{
              background: "#e5e7eb",
              padding: "10px",
              borderRadius: "8px",
              marginBottom: "8px",
              boxShadow:
                expandedTodo === todo.id
                  ? "0 4px 12px rgba(79, 70, 229, 0.3)"
                  : "none",
              transition: "box-shadow 0.3s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>{todo.title}</strong>
              <div>
                <button
                  onClick={() =>
                    setExpandedTodo(expandedTodo === todo.id ? null : todo.id)
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#4f46e5",
                    cursor: "pointer",
                    fontWeight: "600",
                    marginRight: "10px",
                    transition: "color 0.3s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#4338ca")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#4f46e5")}
                >
                  {expandedTodo === todo.id ? "Hide Details" : "View More"}
                </button>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "red",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                  onClick={() => deleteTodo(todo.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            {expandedTodo === todo.id && (
              <div
                style={{
                  marginTop: "8px",
                  background: "#f9fafb",
                  padding: "8px",
                  borderRadius: "6px",
                }}
              >
                <p>
                  <strong>Description:</strong>{" "}
                  {todo.description || "No description"}
                </p>
                {todo.allDay ? (
                  <p>
                    <strong>All Day</strong>
                  </p>
                ) : (
                  <p>
                    <strong>From:</strong> {todo.fromTime} <strong>To:</strong>{" "}
                    {todo.toTime}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Popup */}
      {showPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.3s ease forwards",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "10px",
              width: "320px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
              animation: "slideDown 0.3s ease forwards",
            }}
          >
            <h3>Add Todo for {selectedDay}</h3>
            <input
              placeholder="Title"
              value={popupData.title}
              onChange={(e) =>
                setPopupData({ ...popupData, title: e.target.value })
              }
              style={{ width: "100%", marginBottom: "8px", padding: "6px" }}
            />
            <textarea
              placeholder="Description"
              value={popupData.description}
              onChange={(e) =>
                setPopupData({ ...popupData, description: e.target.value })
              }
              style={{ width: "100%", marginBottom: "8px", padding: "6px" }}
            />
            <label style={{ display: "block", marginBottom: "8px" }}>
              <input
                type="checkbox"
                checked={popupData.allDay}
                onChange={(e) =>
                  setPopupData({ ...popupData, allDay: e.target.checked })
                }
              />{" "}
              All Day
            </label>
            {!popupData.allDay && (
              <>
                <input
                  type="time"
                  value={popupData.fromTime}
                  onChange={(e) =>
                    setPopupData({ ...popupData, fromTime: e.target.value })
                  }
                  style={{ width: "100%", margin: "5px 0", padding: "6px" }}
                />
                <input
                  type="time"
                  value={popupData.toTime}
                  onChange={(e) =>
                    setPopupData({ ...popupData, toTime: e.target.value })
                  }
                  style={{ width: "100%", marginBottom: "8px", padding: "6px" }}
                />
              </>
            )}
            <div style={{ marginTop: "10px", textAlign: "right" }}>
              <button
                onClick={createTodo}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  marginRight: "8px",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#4338ca")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#4f46e5")
                }
              >
                Save
              </button>
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "black",
                  border: "1px solid #ccc",
                  background: "white",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f0f0f0")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "white")
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={signOut}
          style={{
            padding: "8px 155px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#b91c1c")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
        >
          Sign out
        </button>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </main>
  );
}

export default App;
