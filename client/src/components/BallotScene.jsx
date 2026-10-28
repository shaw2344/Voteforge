import { Suspense, lazy } from 'react';

const BallotSceneContent = lazy(() => import('./BallotSceneContent.jsx'));

export default function BallotScene() {
  return (
    <div className="scene-wrap" aria-hidden="true">
      <Suspense fallback={null}>
        <BallotSceneContent />
      </Suspense>
    </div>
  );
}
