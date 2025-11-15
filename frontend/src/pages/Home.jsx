import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            RPG Narrative Engine
          </h1>
          <p className="text-xl text-gray-300">
            A dark fantasy adventure awaits... or create your own story
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Play Game Card */}
          <Link
            to="/game"
            className="group bg-gray-800/50 backdrop-blur-sm border-2 border-purple-500/30 rounded-xl p-8 hover:border-purple-500 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">🎮</div>
              <h2 className="text-3xl font-bold text-white mb-3">Play Game</h2>
              <p className="text-gray-300 mb-4">
                Experience "The Shadow of Thornhaven" - A tale of plague, sacrifice, and dark choices
              </p>
              <div className="text-purple-400 group-hover:text-purple-300">
                Start your adventure →
              </div>
            </div>
          </Link>

          {/* Campaign Editor Card */}
          <Link
            to="/editor"
            className="group bg-gray-800/50 backdrop-blur-sm border-2 border-blue-500/30 rounded-xl p-8 hover:border-blue-500 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/50"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">✏️</div>
              <h2 className="text-3xl font-bold text-white mb-3">Campaign Editor</h2>
              <p className="text-gray-300 mb-4">
                Create and edit campaigns, locations, NPCs, and narrative nodes
              </p>
              <div className="text-blue-400 group-hover:text-blue-300">
                Open editor →
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-center">
          <div className="text-gray-400 text-sm">
            Built with FastAPI + React + TailwindCSS
          </div>
        </div>
      </div>
    </div>
  );
}
