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

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
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
    reminderSet: false,
    reminderTime: "",
  });
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);

  const { signOut } = useAuthenticator();

  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
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

  async function saveTodo() {
    if (!popupData.title.trim()) {
      alert("Title is required");
      return;
    }
    if (editingTodoId) {
      // Update existing todo
      await client.models.Todo.update({
        id: editingTodoId,
        title: popupData.title.trim(),
        description: popupData.description.trim() || undefined,
        date: selectedDay,
        fromTime: popupData.allDay ? undefined : popupData.fromTime || undefined,
        toTime: popupData.allDay ? undefined : popupData.toTime || undefined,
        allDay: popupData.allDay,
        reminderSet: popupData.reminderSet,
        reminderTime: popupData.reminderSet ? popupData.reminderTime : undefined,
      });
    } else {
      // Create new todo
      await client.models.Todo.create({
        title: popupData.title.trim(),
        description: popupData.description.trim() || undefined,
        date: selectedDay,
        fromTime: popupData.allDay ? undefined : popupData.fromTime || undefined,
        toTime: popupData.allDay ? undefined : popupData.toTime || undefined,
        allDay: popupData.allDay,
        reminderSet: popupData.reminderSet,
        reminderTime: popupData.reminderSet ? popupData.reminderTime : undefined,
      });
    }
    setShowPopup(false);
    setPopupData({
      title: "",
      description: "",
      fromTime: "",
      toTime: "",
      allDay: false,
      reminderSet: false,
      reminderTime: "",
    });
    setEditingTodoId(null);
  }

  async function deleteTodo(id: string) {
    await client.models.Todo.delete({ id });
  }

  async function addUnplannedTodo() {
    const title = window.prompt("Enter unplanned todo title:");
    if (!title || !title.trim()) return;
    await client.models.Todo.create({
      title: title.trim(),
      date: null,
    });
  }

  function editTodo(todo: Schema["Todo"]["type"]) {
    setPopupData({
      title: todo.title || "",
      description: todo.description || "",
      fromTime: todo.fromTime || "",
      toTime: todo.toTime || "",
      allDay: todo.allDay || false,
      reminderSet: todo.reminderSet || false,
      reminderTime: todo.reminderTime || "",
    });
    setEditingTodoId(todo.id);
    setShowPopup(true);
  }

  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const totalDays = daysInMonth(currentYear, currentMonth);

  const filteredTodos = todos.filter((t) => t.date === selectedDay);
  const unplannedTodos = todos.filter((t) => !t.date);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: "20px",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <main style={{ overflowY: "auto", marginRight: "280px" }}>
        <h1>📅 My Calendar Todos</h1>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 8 }}>
          <button onClick={prevYear} style={{ padding: "6px 10px", cursor: "pointer" }}>← Prev Year</button>
          <div style={{ fontWeight: "bold", fontSize: "1.2rem", lineHeight: "32px" }}>{currentYear}</div>
          <button onClick={nextYear} style={{ padding: "6px 10px", cursor: "pointer" }}>Next Year →</button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={prevMonth} style={{ padding: "8px 12px", cursor: "pointer" }}>← Prev Month</button>
          <div style={{ fontWeight: "bold", fontSize: "1.5rem", lineHeight: "36px" }}>
            {monthNames[currentMonth - 1]}
          </div>
          <button onClick={nextMonth} style={{ padding: "8px 12px", cursor: "pointer" }}>Next Month →</button>
        </div>

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

        <h2>Tasks for {selectedDay}</h2>
        <button
          onClick={() => {
            setShowPopup(true);
            setEditingTodoId(null);
            setPopupData({
              title: "",
              description: "",
              fromTime: "",
              toTime: "",
              allDay: false,
              reminderSet: false,
              reminderTime: "",
            });
          }}
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
                    onClick={() => editTodo(todo)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#2563eb",
                      cursor: "pointer",
                      fontWeight: "600",
                      marginRight: "10px",
                    }}
                    title="Edit"
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1e40af")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#2563eb")}
                  >
                    Edit
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
                  {todo.reminderSet && (
                    <p>
                      <strong>Reminder set for:</strong> {todo.reminderTime}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

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
              <h3>{editingTodoId ? "Edit" : "Add"} Todo for {selectedDay}</h3>
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

              {/* Reminder Section */}
              <label style={{ display: "block", marginBottom: "8px" }}>
                <input
                  type="checkbox"
                  checked={popupData.reminderSet}
                  onChange={(e) =>
                    setPopupData({ ...popupData, reminderSet: e.target.checked })
                  }
                  disabled={popupData.allDay}
                />{" "}
                Set Reminder
              </label>
              {popupData.reminderSet && !popupData.allDay && (
                <input
                  type="time"
                  value={popupData.reminderTime}
                  onChange={(e) =>
                    setPopupData({ ...popupData, reminderTime: e.target.value })
                  }
                  style={{ width: "100%", marginBottom: "8px", padding: "6px" }}
                />
              )}

              <div style={{ marginTop: "10px", textAlign: "right" }}>
                <button
                  onClick={saveTodo}
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
                  onClick={() => {
                    setShowPopup(false);
                    setEditingTodoId(null);
                    setPopupData({
                      title: "",
                      description: "",
                      fromTime: "",
                      toTime: "",
                      allDay: false,
                      reminderSet: false,
                      reminderTime: "",
                    });
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
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
              padding: "8px 12px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#b91c1c")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
          >
            Sign Out
          </button>
        </div>
      </main>

      <aside
        style={{
          width: "260px",
          position: "fixed",
          right: 0,
          top: 0,
          height: "100vh",
          borderLeft: "1px solid #ccc",
          padding: "20px",
          boxSizing: "border-box",
          overflowY: "auto",
          backgroundColor: "#f9fafb",
        }}
      >
        <h2>Unplanned Tasks</h2>
        <button
          onClick={addUnplannedTodo}
          style={{
            padding: "8px 12px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            marginBottom: "12px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#10b981")}
        >
          + Add Unplanned
        </button>
        {unplannedTodos.length === 0 && <p>No unplanned todos.</p>}
        {unplannedTodos.map((todo) => (
          <div
            key={todo.id}
            style={{
              background: "#e0f2fe",
              padding: "10px",
              borderRadius: "8px",
              marginBottom: "8px",
              boxShadow:
                expandedTodo === todo.id
                  ? "0 4px 12px rgba(14, 165, 233, 0.5)"
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
                    color: "#0369a1",
                    cursor: "pointer",
                    fontWeight: "600",
                    marginRight: "10px",
                    transition: "color 0.3s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0c4a6e")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#0369a1")}
                >
                  {expandedTodo === todo.id ? "Hide Details" : "View More"}
                </button>
                <button
                  onClick={() => editTodo(todo)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#0284c7",
                    cursor: "pointer",
                    fontWeight: "600",
                    marginRight: "10px",
                  }}
                  title="Edit"
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0369a1")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#0284c7")}
                >
                  Edit
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
                  background: "#e0f7fa",
                  padding: "8px",
                  borderRadius: "6px",
                }}
              >
                <p>
                  <strong>Description:</strong>{" "}
                  {todo.description || "No description"}
                </p>
                {todo.reminderSet && (
                  <p>
                    <strong>Reminder set for:</strong> {todo.reminderTime}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </aside>
    </div>
  );
}

export default App;
