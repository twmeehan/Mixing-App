// Homepage.tsx
import ActivityCardContainer from "./components/ActivityCardContainer";
import Header from "./components/Header";

const activities = [
  {
    title: "Sample Activity 1",
    backgroundColor: "#60a5fa",
    metrics: [
      { label: "Highscore", value: 98},
      { label: "Average", value: 75},
    ],
  },
  {
    title: "Sample Activity 2",
    backgroundColor: "#f472b6",
    metrics: [
        { label: "Accuracy", value: 85},
        { label: "Average", value: 25 }
    ],
  },
  {
    title: "Sample Activity 3",
    backgroundColor: "#fa9d24ff",
    metrics: [{ label: "Accuracy", value: 10}],
  },
  {
    title: "Sample Activity 4",
    backgroundColor: "#d5cb14ff",
    metrics: [{ label: "Accuracy", value: 100}],
  },
  {
    title: "Sample Activity 5",
    backgroundColor: "#34d399",
    metrics: [{ label: "Accuracy", value: 40}],
  },
];

export default function Homepage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-[10vh] p-8">
        <ActivityCardContainer
          items={activities}
          maxHeight="70vh"
          className=""
        />
      </main>
    </div>
  );
}
