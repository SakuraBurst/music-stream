import { BrowserRouter, Routes, Route } from 'react-router';

import ProtectedRoute from './components/Auth/ProtectedRoute.tsx';
import MainLayout from './components/Layout/MainLayout.tsx';
import ExpandedPlayer from './components/Player/ExpandedPlayer.tsx';
import PlayerProvider from './components/Player/PlayerProvider.tsx';
import ZenPlayer from './components/Player/ZenPlayer.tsx';
import HomePage from './pages/HomePage.tsx';
import ArtistsPage from './pages/ArtistsPage.tsx';
import ArtistDetailPage from './pages/ArtistDetailPage.tsx';
import AlbumsPage from './pages/AlbumsPage.tsx';
import AlbumDetailPage from './pages/AlbumDetailPage.tsx';
import TracksPage from './pages/TracksPage.tsx';
import PlaylistsPage from './pages/PlaylistsPage.tsx';
import PlaylistDetailPage from './pages/PlaylistDetailPage.tsx';
import FavoritesPage from './pages/FavoritesPage.tsx';
import HistoryPage from './pages/HistoryPage.tsx';
import SearchPage from './pages/SearchPage.tsx';
import UploadPage from './pages/UploadPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider />
      <ZenPlayer />
      <ExpandedPlayer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="artists" element={<ArtistsPage />} />
            <Route path="artists/:id" element={<ArtistDetailPage />} />
            <Route path="albums" element={<AlbumsPage />} />
            <Route path="albums/:id" element={<AlbumDetailPage />} />
            <Route path="tracks" element={<TracksPage />} />
            <Route path="playlists" element={<PlaylistsPage />} />
            <Route path="playlists/:id" element={<PlaylistDetailPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="upload" element={<UploadPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
