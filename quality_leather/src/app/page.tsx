import PhotoUpload from '@/components/PhotoUpload'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <header className="text-center mb-14">
          <h1 className="text-5xl font-bold tracking-tight text-stone-900 mb-4">
            Quality Leather
          </h1>
          <p className="text-xl text-stone-500 max-w-xl mx-auto leading-relaxed">
            Upload 4 photos of a garment you love. Our AI will analyze it and generate a
            spin-around leather preview — then hand it off to a tailor to make it real.
          </p>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <h2 className="text-base font-semibold text-stone-700 mb-6 text-center uppercase tracking-wide">
            Upload 4 photos of your garment
          </h2>
          <PhotoUpload />
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          Supported formats: JPEG · PNG · WebP · GIF &nbsp;|&nbsp; Max 10 MB per photo
        </p>
      </div>
    </main>
  )
}
