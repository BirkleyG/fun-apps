import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import { localRecordings } from "./db";
import { DEFAULT_TEMPLATES } from "./templates";

const templatesCol = (uid) => collection(db, "users", uid, "meetingTemplates");
const recordingsCol = (uid) => collection(db, "users", uid, "meetingRecordings");

function extFromMime(mimeType) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("aac")) return "aac";
  return "audio";
}

export async function ensureDefaultTemplates(uid) {
  const snap = await getDocs(templatesCol(uid));
  if (!snap.empty) return;
  await Promise.all(
    DEFAULT_TEMPLATES.map((tpl) => setDoc(doc(templatesCol(uid), tpl.id), { ...tpl, createdAt: serverTimestamp() }))
  );
}

export function subscribeTemplates(uid, callback) {
  return onSnapshot(templatesCol(uid), (snap) => {
    const templates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    templates.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    callback(templates);
  });
}

export async function saveTemplate(uid, template) {
  await setDoc(doc(templatesCol(uid), template.id), {
    name: template.name,
    sections: template.sections,
    createdAt: template.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function deleteTemplate(uid, templateId) {
  await deleteDoc(doc(templatesCol(uid), templateId));
}

export async function listCloudRecordings(uid) {
  const q = query(recordingsCol(uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, storageMode: "cloud", ...d.data() }));
}

export async function listLocalRecordings() {
  const all = await localRecordings.all();
  return all
    .map((r) => ({ ...r, storageMode: "device" }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function saveRecording({ uid, storageMode, blob, mimeType, transcript, durationSec, title }) {
  const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (storageMode === "device") {
    const record = {
      id,
      title,
      createdAt: Date.now(),
      durationSec,
      mimeType,
      transcript,
      blob,
      templateId: null,
      formatted: null
    };
    await localRecordings.put(record);
    return { ...record, storageMode: "device" };
  }

  const path = `meeting-recorder/${uid}/${id}.${extFromMime(mimeType)}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: mimeType });

  const data = {
    title,
    createdAt: serverTimestamp(),
    durationSec,
    mimeType,
    transcript,
    audioPath: path,
    templateId: null,
    formatted: null
  };
  await setDoc(doc(recordingsCol(uid), id), data);
  return { id, storageMode: "cloud", ...data, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
}

export async function getAudioUrl(recording) {
  if (recording.storageMode === "device") {
    return URL.createObjectURL(recording.blob);
  }
  const storageRef = ref(storage, recording.audioPath);
  return getDownloadURL(storageRef);
}

export async function updateFormatted(uid, recording, templateId, formatted) {
  if (recording.storageMode === "device") {
    const updated = { ...recording, templateId, formatted };
    delete updated.storageMode;
    await localRecordings.put(updated);
    return;
  }
  await updateDoc(doc(recordingsCol(uid), recording.id), { templateId, formatted });
}

export async function deleteRecording(uid, recording) {
  if (recording.storageMode === "device") {
    await localRecordings.delete(recording.id);
    return;
  }
  if (recording.audioPath) {
    await deleteObject(ref(storage, recording.audioPath)).catch(() => undefined);
  }
  await deleteDoc(doc(recordingsCol(uid), recording.id));
}
