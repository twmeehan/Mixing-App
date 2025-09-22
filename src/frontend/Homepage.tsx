import Header from "./components/Header";

function Homepage() {
  return (
    <div className="min-h-screen">
      {/* sticky, full-width, 10% tall strip */}
      <div className="fixed top-0 left-0 w-screen h-[10vh]">
        <Header />
      </div>

      {/* push content below header */}
      <main className="pt-[10vh] p-8">
        <p>This is the homepage of the Ear Training App.</p>
      </main>
    </div>
  );
}

export default Homepage;
