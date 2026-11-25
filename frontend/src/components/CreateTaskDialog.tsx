import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api";
import type { TaskCreate } from "@/lib/tasks";
import { useCreateTask } from "@/lib/tasks";

const EMPTY: TaskCreate = { nazwa: "", klient: "", adres: "", termin: "", opis: "" };

export function CreateTaskDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TaskCreate>(EMPTY);
  const create = useCreateTask();
  const navigate = useNavigate();

  const set = (k: keyof TaskCreate) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.nazwa.trim() && form.klient.trim() && form.adres.trim() && form.termin;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate(form, {
      onSuccess: (task) => {
        toast.success("Zadanie montażowe utworzone");
        setOpen(false);
        setForm(EMPTY);
        navigate(`/zadanie/${task.id}`);
      },
      onError: (err) => toast.error(apiErrorMessage(err, "Nie udało się utworzyć zadania")),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            data-testid="btn-new-task"
            className="h-10 gap-2 px-4 font-semibold transition-shadow duration-200 hover:bg-wimed-dark hover:shadow-[0_0_20px_rgba(225,29,72,0.35)]"
          />
        }
      >
        <Plus className="h-4 w-4" /> Nowe zadanie
      </DialogTrigger>
      <DialogContent data-testid="modal-create-task" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Nowe zadanie montażowe</DialogTitle>
          <DialogDescription>Po utworzeniu otrzymasz publiczny link do zadania.</DialogDescription>
        </DialogHeader>
        <form data-testid="form-create-task" onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nazwa">Nazwa zadania *</Label>
            <Input id="nazwa" data-testid="input-task-name" value={form.nazwa} onChange={set("nazwa")} placeholder="np. Montaż tablic kierunkowych DK79" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="klient">Klient *</Label>
              <Input id="klient" data-testid="input-task-client" value={form.klient} onChange={set("klient")} placeholder="np. GDDKiA O/Kraków" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="termin">Termin *</Label>
              <Input id="termin" type="date" data-testid="input-task-deadline" value={form.termin} onChange={set("termin")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adres">Adres montażu *</Label>
            <Input id="adres" data-testid="input-task-address" value={form.adres} onChange={set("adres")} placeholder="np. DK79 km 18+400, Piaseczno" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="opis">Opis</Label>
            <Textarea id="opis" data-testid="input-task-description" value={form.opis} onChange={set("opis")} rows={3} placeholder="Zakres prac, uwagi…" />
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="btn-submit-task" disabled={!valid || create.isPending} className="hover:bg-wimed-dark">
              {create.isPending ? "Zapisywanie…" : "Utwórz zadanie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
